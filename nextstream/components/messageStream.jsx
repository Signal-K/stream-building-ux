import { useState, useEffect, useCallback, cloneElement, memo, useMemo, forwardRef, useRef, useLayoutEffect } from 'react';
import cn from 'classnames';
import { useSpring, animated } from '@react-spring/web'
import { queryDB } from '../pages/api/vectorRetrieval';
import { sendChat } from '../pages/api/chat';
import { Rnd } from 'react-rnd';
import debounce from 'lodash.debounce';
import { ImSpinner2 } from 'react-icons/im';
import { AiOutlineSend } from 'react-icons/ai';
import Masks from '../assets/Masks.png';
import { StreamSidebar } from '.Sidebar';
import Tweet, { Account, Card, ContentSwitch } from './Tweet';
import { VariableSizeGrid } from 'react-window';
import tftTweets from '../static/sample.json'
import { left } from '@popperjs/core';
import useMeasure from 'react-use-measure';

const MessageStream = ({chatHistory, width }) => {
    // measure height of message stream
    const [messageRef, bounds] = useMeasure()
  
    // force rerender when bounds changes
    const [_, setRerender] = useState(0)
  
    useLayoutEffect(() => {
      setRerender(_ => _ + 1)
    }, [bounds])
  
    console.log(chatHistory.length)
    
    const sessionHeader = chatHistory.length > 1 &&
      <Dialog 
        className = {cn(
          "sticky top-0 pb-2 border-b border-gray-500",
          {"border-b-0 bg-bg/0 backdrop-blur-none": chatHistory.length < 2},
          {"backdrop-blur-xl bg-bg/40": chatHistory.length >= 2}
        )} 
        chatMessage = {chatHistory[1] || chatHistory[0]} 
        key = {1} 
      />
  
    const offsetLeft = 30
  
    // render a stream of messages
    return (
      <div 
        ref = {messageRef}
        style = {{
          left: -offsetLeft,
          top: -bounds?.height - 16, 
          maxHeight: 320, 
          width: width + offsetLeft}}
        className="absolute overflow-scroll w-full flex flex-col gap-2"
      >
        {sessionHeader}
        {chatHistory.slice(2, chatHistory.length).map((message, i) => <Dialog chatMessage={message} key={i + 1}/>)}
      </div>
  
    )
  
  }

export default MessageStream;